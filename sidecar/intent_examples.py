"""Intent class examples for zero-shot classification of counterfactual outcomes.

Each intent class has 5 example feature vectors representing typical metric deltas
from different counterfactual intervention patterns.

FEATURE_ORDER defines the canonical feature vector layout sent to TabFM.
"""

FEATURE_ORDER = [
    "gdp_mean_delta",       # Mean GDP delta across nations (billions)
    "gdp_growth_delta",     # Mean GDP growth rate delta (percentage points)
    "inflation_delta",      # Mean inflation rate delta
    "unemployment_delta",   # Mean unemployment rate delta
    "trade_volume_delta",   # Mean trade volume delta
    "temperature_anomaly",  # Temperature anomaly delta (degrees C)
    "emissions_delta",      # CO2 emissions delta (Gt)
    "population_delta",     # Population delta (millions)
    "birth_rate_delta",     # Birth rate delta (per 1000)
    "occupancy_rate",       # Hospital occupancy rate delta
    "innovation_count",     # Technology innovation count delta
    "war_count_delta",      # Active war count delta
]

EXAMPLE_POOL = {
    "economic_recovery": [
        {"features": {"gdp_mean_delta": 25.0, "gdp_growth_delta": 2.0, "inflation_delta": -1.0, "unemployment_delta": -2.0, "trade_volume_delta": 5.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 15.0, "gdp_growth_delta": 1.5, "inflation_delta": -0.5, "unemployment_delta": -1.5, "trade_volume_delta": 3.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 10.0, "gdp_growth_delta": 1.0, "inflation_delta": -0.3, "unemployment_delta": -1.0, "trade_volume_delta": 2.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 1, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 30.0, "gdp_growth_delta": 2.5, "inflation_delta": -1.2, "unemployment_delta": -2.5, "trade_volume_delta": 6.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.5, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 20.0, "gdp_growth_delta": 1.8, "inflation_delta": -0.8, "unemployment_delta": -1.8, "trade_volume_delta": 4.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.2, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "economic_collapse": [
        {"features": {"gdp_mean_delta": -25.0, "gdp_growth_delta": -3.0, "inflation_delta": 5.0, "unemployment_delta": 4.0, "trade_volume_delta": -20.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -15.0, "gdp_growth_delta": -2.0, "inflation_delta": 3.0, "unemployment_delta": 3.0, "trade_volume_delta": -15.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -10.0, "gdp_growth_delta": -1.5, "inflation_delta": 2.0, "unemployment_delta": 2.0, "trade_volume_delta": -10.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -35.0, "gdp_growth_delta": -4.0, "inflation_delta": 7.0, "unemployment_delta": 5.0, "trade_volume_delta": -25.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -20.0, "gdp_growth_delta": -2.5, "inflation_delta": 4.0, "unemployment_delta": 3.5, "trade_volume_delta": -18.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "supply_chain_disruption": [
        {"features": {"gdp_mean_delta": -3.0, "gdp_growth_delta": -0.5, "inflation_delta": 2.0, "unemployment_delta": 1.0, "trade_volume_delta": -12.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -5.0, "gdp_growth_delta": -0.8, "inflation_delta": 3.0, "unemployment_delta": 1.5, "trade_volume_delta": -8.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -2.0, "gdp_growth_delta": -0.3, "inflation_delta": 1.5, "unemployment_delta": 0.5, "trade_volume_delta": -15.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -4.0, "gdp_growth_delta": -0.6, "inflation_delta": 2.5, "unemployment_delta": 1.2, "trade_volume_delta": -10.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -1.0, "gdp_growth_delta": -0.2, "inflation_delta": 1.0, "unemployment_delta": 0.3, "trade_volume_delta": -6.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "population_shock": [
        {"features": {"gdp_mean_delta": -2.0, "gdp_growth_delta": -0.3, "inflation_delta": 0.5, "unemployment_delta": 0.5, "trade_volume_delta": 0.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": -5.0, "birth_rate_delta": -2.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -5.0, "gdp_growth_delta": -0.5, "inflation_delta": 1.0, "unemployment_delta": 1.0, "trade_volume_delta": -2.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": -10.0, "birth_rate_delta": -3.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -1.0, "gdp_growth_delta": -0.1, "inflation_delta": 0.3, "unemployment_delta": 0.3, "trade_volume_delta": -1.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": -3.0, "birth_rate_delta": -1.5, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -8.0, "gdp_growth_delta": -1.0, "inflation_delta": 1.5, "unemployment_delta": 1.5, "trade_volume_delta": -3.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": -15.0, "birth_rate_delta": -4.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -3.0, "gdp_growth_delta": -0.4, "inflation_delta": 0.8, "unemployment_delta": 0.8, "trade_volume_delta": -1.5, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": -7.0, "birth_rate_delta": -2.5, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "climate_drift": [
        {"features": {"gdp_mean_delta": 0.0, "gdp_growth_delta": 0.0, "inflation_delta": 0.0, "unemployment_delta": 0.0, "trade_volume_delta": 0.0, "temperature_anomaly": 2.0, "emissions_delta": 5.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.02, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -1.0, "gdp_growth_delta": -0.1, "inflation_delta": 0.2, "unemployment_delta": 0.1, "trade_volume_delta": -1.0, "temperature_anomaly": 1.5, "emissions_delta": 3.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.01, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 0.5, "gdp_growth_delta": 0.1, "inflation_delta": -0.1, "unemployment_delta": -0.1, "trade_volume_delta": 0.5, "temperature_anomaly": 3.0, "emissions_delta": 7.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.03, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -0.5, "gdp_growth_delta": -0.05, "inflation_delta": 0.1, "unemployment_delta": 0.05, "trade_volume_delta": -0.5, "temperature_anomaly": 2.5, "emissions_delta": 4.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.02, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 0.2, "gdp_growth_delta": 0.02, "inflation_delta": 0.0, "unemployment_delta": 0.0, "trade_volume_delta": 0.0, "temperature_anomaly": 1.0, "emissions_delta": 2.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.01, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "no_effect": [
        {"features": {"gdp_mean_delta": 0.1, "gdp_growth_delta": 0.01, "inflation_delta": 0.01, "unemployment_delta": 0.01, "trade_volume_delta": 0.1, "temperature_anomaly": 0.01, "emissions_delta": 0.01, "population_delta": 0.01, "birth_rate_delta": 0.01, "occupancy_rate": 0.001, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -0.05, "gdp_growth_delta": -0.01, "inflation_delta": -0.01, "unemployment_delta": -0.01, "trade_volume_delta": -0.05, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 0.0, "gdp_growth_delta": 0.0, "inflation_delta": 0.0, "unemployment_delta": 0.0, "trade_volume_delta": 0.0, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -0.1, "gdp_growth_delta": -0.02, "inflation_delta": 0.02, "unemployment_delta": 0.02, "trade_volume_delta": -0.1, "temperature_anomaly": -0.01, "emissions_delta": -0.01, "population_delta": -0.01, "birth_rate_delta": -0.01, "occupancy_rate": -0.001, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": 0.01, "gdp_growth_delta": 0.0, "inflation_delta": 0.0, "unemployment_delta": 0.0, "trade_volume_delta": 0.01, "temperature_anomaly": 0.0, "emissions_delta": 0.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.0, "innovation_count": 0, "war_count_delta": 0}},
    ],
    "hospital_pressure": [
        {"features": {"gdp_mean_delta": -0.5, "gdp_growth_delta": -0.1, "inflation_delta": 0.2, "unemployment_delta": 0.2, "trade_volume_delta": -0.5, "temperature_anomaly": 0.5, "emissions_delta": 0.5, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.15, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -1.0, "gdp_growth_delta": -0.2, "inflation_delta": 0.3, "unemployment_delta": 0.3, "trade_volume_delta": -1.0, "temperature_anomaly": 0.8, "emissions_delta": 1.0, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.20, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -0.2, "gdp_growth_delta": -0.05, "inflation_delta": 0.1, "unemployment_delta": 0.1, "trade_volume_delta": -0.2, "temperature_anomaly": 0.3, "emissions_delta": 0.3, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.10, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -1.5, "gdp_growth_delta": -0.3, "inflation_delta": 0.5, "unemployment_delta": 0.5, "trade_volume_delta": -1.5, "temperature_anomaly": 1.0, "emissions_delta": 1.5, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.25, "innovation_count": 0, "war_count_delta": 0}},
        {"features": {"gdp_mean_delta": -0.8, "gdp_growth_delta": -0.15, "inflation_delta": 0.25, "unemployment_delta": 0.25, "trade_volume_delta": -0.8, "temperature_anomaly": 0.6, "emissions_delta": 0.8, "population_delta": 0.0, "birth_rate_delta": 0.0, "occupancy_rate": 0.18, "innovation_count": 0, "war_count_delta": 0}},
    ],
}
