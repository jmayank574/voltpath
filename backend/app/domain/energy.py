"""Voltpath energy & feasibility model.

This module is intentionally PURE: no I/O, no database, no network, no framework.
It is the auditable heart of the product. Every assumption is a named, visible
parameter on :class:`ModelParams` so a skeptical reviewer can see there is no
black box.

Grounding (see DATA_SOURCES.md):
  * Base consumption per truck is calibrated to a published/measured kWh/mi.
  * Payload sensitivity (`payload_coefficient_kwh_per_mi_per_ton`) is grounded in
    rolling-resistance physics and the ~51 Wh/ton-mile figure from
    arXiv:1804.05974, bracketed by NACFE measured 1.55-1.72 kWh/mi (Tesla Semi).

Units: energy in kWh, distance in miles, weight in pounds, power in kW, time in
hours. Money is the only quantity carried as Decimal (see `charge_cost_usd`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum

LB_PER_TON: float = 2000.0


class Verdict(str, Enum):
    """The three-state operational answer a dispatcher needs."""

    FEASIBLE = "feasible"  # completes on time, no charging needed
    FEASIBLE_WITH_CHARGING = "feasible_with_charging"  # on time, but must charge
    INFEASIBLE = "infeasible"  # out of range with no viable charger, or can't make the window


@dataclass(frozen=True)
class TruckSpec:
    """Real, cited spec for a candidate truck. See DATA_SOURCES.md."""

    name: str
    usable_kwh: float
    base_consumption_kwh_per_mi: float  # measured/published, at `reference_payload_lb`
    reference_payload_lb: float
    max_charge_kw: float
    gvwr_lb: float


@dataclass(frozen=True)
class ModelParams:
    """Every assumption in the model, as a visible, tunable parameter.

    Defaults are deliberately conservative and are surfaced in the UI's
    Methodology panel. None of these is a hidden magic number.
    """

    # Arrive with at least this much battery left (safety reserve).
    reserve_pct: float = 15.0
    # Fixed handling/dwell time added to every trip (loading, gate, inspection).
    dwell_buffer_min: float = 30.0
    # Marginal kWh/mi added per ton of payload above the truck's reference payload.
    # Grounded in rolling-resistance physics (~51 Wh/ton-mile, arXiv:1804.05974).
    payload_coefficient_kwh_per_mi_per_ton: float = 0.025
    # Fraction of grid energy that lands in the battery (charging losses) -> cost only.
    charge_efficiency: float = 0.92
    # We only model charging up to this SoC cap. The high-SoC taper above this is
    # NOT modeled (flagged in the UI). A single stop cannot exceed this cap.
    charge_soc_cap_pct: float = 80.0
    # Energy price for cost estimates.
    energy_price_per_kwh_usd: Decimal = Decimal("0.20")


# --------------------------------------------------------------------------- #
# Core physics (pure functions, each independently testable)
# --------------------------------------------------------------------------- #


def payload_tons(payload_lb: float) -> float:
    return payload_lb / LB_PER_TON


def consumption_kwh_per_mi(
    truck: TruckSpec, payload_lb: float, params: ModelParams
) -> float:
    """Payload-adjusted energy consumption.

    C(p) = C_base + k * (p - p_ref), with p in tons. Clamped to >= 0.
    """
    delta_tons = (payload_lb - truck.reference_payload_lb) / LB_PER_TON
    consumption = (
        truck.base_consumption_kwh_per_mi
        + params.payload_coefficient_kwh_per_mi_per_ton * delta_tons
    )
    return max(consumption, 0.0)


def energy_required_kwh(
    truck: TruckSpec, payload_lb: float, distance_mi: float, params: ModelParams
) -> float:
    """Energy to drive `distance_mi` carrying `payload_lb`."""
    return consumption_kwh_per_mi(truck, payload_lb, params) * distance_mi


def usable_energy_for_trip_kwh(
    truck: TruckSpec, soc_start_pct: float, params: ModelParams
) -> float:
    """Energy available to spend while still arriving with the reserve intact.

    = usable_kwh * (SOC_start - reserve_pct) / 100, clamped to >= 0.
    """
    frac = (soc_start_pct - params.reserve_pct) / 100.0
    return max(truck.usable_kwh * frac, 0.0)


def effective_charge_power_kw(truck: TruckSpec, station_max_kw: float) -> float:
    """Power actually delivered into the battery: limited by the weaker side."""
    return min(truck.max_charge_kw, station_max_kw)


def charge_time_hours(energy_to_add_kwh: float, effective_power_kw: float) -> float:
    if energy_to_add_kwh <= 0:
        return 0.0
    if effective_power_kw <= 0:
        raise ValueError("effective charge power must be positive")
    return energy_to_add_kwh / effective_power_kw


def single_stop_headroom_kwh(truck: TruckSpec, params: ModelParams) -> float:
    """Max energy a single stop can add: from the reserve floor up to the SoC cap.

    Charging beyond one stop's worth is NOT modeled in v1 (flagged as a limit).
    """
    span_pct = params.charge_soc_cap_pct - params.reserve_pct
    return max(truck.usable_kwh * span_pct / 100.0, 0.0)


def charge_cost_usd(energy_to_add_kwh: float, params: ModelParams) -> Decimal:
    """Cost of the charge, in USD, accounting for charging losses (grid draw).

    Money is Decimal end-to-end here; the float->Decimal boundary lives in this
    one function (see DECISIONS.md D4).
    """
    if energy_to_add_kwh <= 0:
        return Decimal("0.00")
    grid_energy = Decimal(str(energy_to_add_kwh)) / Decimal(str(params.charge_efficiency))
    return (grid_energy * params.energy_price_per_kwh_usd).quantize(Decimal("0.01"))


# --------------------------------------------------------------------------- #
# Verdict assembly
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Assessment:
    """The auditable result: a verdict plus every number behind it."""

    verdict: Verdict
    reasons: tuple[str, ...]
    consumption_kwh_per_mi: float
    energy_required_kwh: float
    usable_energy_for_trip_kwh: float
    charging_required: bool
    energy_to_add_kwh: float
    charge_time_hours: float
    charge_cost_usd: Decimal
    drive_hours: float
    dwell_hours: float
    total_hours: float
    projected_arrival: datetime
    on_time: bool


def assess(
    *,
    truck: TruckSpec,
    payload_lb: float,
    distance_mi: float,
    drive_hours: float,
    depart_at: datetime,
    deliver_by: datetime,
    soc_start_pct: float,
    params: ModelParams,
    charger_max_kw: float | None = None,
    charger_reachable: bool = False,
) -> Assessment:
    """Produce the three-state verdict from resolved route facts.

    Route distance/drive-time and whether a corridor charger is reachable are
    resolved by the integration layer and passed in; this function stays pure so
    it can be exhaustively unit-tested. It always returns the supporting numbers
    and human-readable reasons.
    """
    consumption = consumption_kwh_per_mi(truck, payload_lb, params)
    energy_req = consumption * distance_mi
    usable = usable_energy_for_trip_kwh(truck, soc_start_pct, params)
    dwell_hours = params.dwell_buffer_min / 60.0
    reasons: list[str] = []

    charging_required = energy_req > usable
    energy_to_add = 0.0
    charge_hours = 0.0
    cost = Decimal("0.00")

    if not charging_required:
        total_hours = drive_hours + dwell_hours
        arrival = depart_at + timedelta(hours=total_hours)
        on_time = arrival <= deliver_by
        if on_time:
            verdict = Verdict.FEASIBLE
            reasons.append(
                f"Within range: needs {energy_req:.0f} kWh, has "
                f"{usable:.0f} kWh available above the {params.reserve_pct:.0f}% reserve."
            )
            reasons.append("Projected arrival is within the delivery window.")
        else:
            verdict = Verdict.INFEASIBLE
            reasons.append(
                "Within range, but drive time plus dwell exceeds the delivery "
                "window even without charging."
            )
        return Assessment(
            verdict=verdict,
            reasons=tuple(reasons),
            consumption_kwh_per_mi=consumption,
            energy_required_kwh=energy_req,
            usable_energy_for_trip_kwh=usable,
            charging_required=False,
            energy_to_add_kwh=0.0,
            charge_time_hours=0.0,
            charge_cost_usd=cost,
            drive_hours=drive_hours,
            dwell_hours=dwell_hours,
            total_hours=total_hours,
            projected_arrival=arrival,
            on_time=on_time,
        )

    # Charging is required.
    energy_to_add = energy_req - usable

    if not charger_reachable or charger_max_kw is None:
        # Out of range with no viable charger along the corridor.
        total_hours = drive_hours + dwell_hours
        arrival = depart_at + timedelta(hours=total_hours)
        reasons.append(
            f"Out of range: needs {energy_req:.0f} kWh but only {usable:.0f} kWh "
            f"is available above reserve, and no viable corridor charger was found."
        )
        return Assessment(
            verdict=Verdict.INFEASIBLE,
            reasons=tuple(reasons),
            consumption_kwh_per_mi=consumption,
            energy_required_kwh=energy_req,
            usable_energy_for_trip_kwh=usable,
            charging_required=True,
            energy_to_add_kwh=energy_to_add,
            charge_time_hours=0.0,
            charge_cost_usd=Decimal("0.00"),
            drive_hours=drive_hours,
            dwell_hours=dwell_hours,
            total_hours=total_hours,
            projected_arrival=arrival,
            on_time=False,
        )

    headroom = single_stop_headroom_kwh(truck, params)
    if energy_to_add > headroom:
        # Would require more than one charge stop; v1 models a single stop only.
        total_hours = drive_hours + dwell_hours
        arrival = depart_at + timedelta(hours=total_hours)
        reasons.append(
            f"Requires adding {energy_to_add:.0f} kWh, more than a single stop can "
            f"provide under the {params.charge_soc_cap_pct:.0f}% SoC cap "
            f"({headroom:.0f} kWh). Multi-stop routing is not modeled in v1."
        )
        return Assessment(
            verdict=Verdict.INFEASIBLE,
            reasons=tuple(reasons),
            consumption_kwh_per_mi=consumption,
            energy_required_kwh=energy_req,
            usable_energy_for_trip_kwh=usable,
            charging_required=True,
            energy_to_add_kwh=energy_to_add,
            charge_time_hours=0.0,
            charge_cost_usd=Decimal("0.00"),
            drive_hours=drive_hours,
            dwell_hours=dwell_hours,
            total_hours=total_hours,
            projected_arrival=arrival,
            on_time=False,
        )

    eff_power = effective_charge_power_kw(truck, charger_max_kw)
    charge_hours = charge_time_hours(energy_to_add, eff_power)
    cost = charge_cost_usd(energy_to_add, params)
    total_hours = drive_hours + charge_hours + dwell_hours
    arrival = depart_at + timedelta(hours=total_hours)
    on_time = arrival <= deliver_by

    if on_time:
        verdict = Verdict.FEASIBLE_WITH_CHARGING
        reasons.append(
            f"Needs a charge stop: add {energy_to_add:.0f} kWh at up to "
            f"{eff_power:.0f} kW (~{charge_hours * 60:.0f} min)."
        )
        reasons.append("Projected arrival including the charge stop is within the window.")
    else:
        verdict = Verdict.INFEASIBLE
        reasons.append(
            f"Charging is possible (add {energy_to_add:.0f} kWh, "
            f"~{charge_hours * 60:.0f} min) but the added time pushes arrival past "
            f"the delivery window."
        )

    return Assessment(
        verdict=verdict,
        reasons=tuple(reasons),
        consumption_kwh_per_mi=consumption,
        energy_required_kwh=energy_req,
        usable_energy_for_trip_kwh=usable,
        charging_required=True,
        energy_to_add_kwh=energy_to_add,
        charge_time_hours=charge_hours,
        charge_cost_usd=cost,
        drive_hours=drive_hours,
        dwell_hours=dwell_hours,
        total_hours=total_hours,
        projected_arrival=arrival,
        on_time=on_time,
    )
