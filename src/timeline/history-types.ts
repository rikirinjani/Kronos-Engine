export interface StrategicWorldState {
  year: number;
  label: string;
  nations: Nation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalAggregate;
}

export interface Nation {
  id: string;
  name: string;
  region: string;
  population: number;
  gdp: number;
  territory: {
    regionIds: string[];
    capital: string;
  };
  government: "democracy" | "autocracy" | "monarchy" | "theocracy" | "transitional";
  technologyLevel: number;
  militaryPower: number;
  healthMetrics: {
    lifeExpectancy: number;
    infantMortality: number;
    hospitalBedsPer1000: number;
    universalCoverage: boolean;
  };
  alliances: string[];
  wars: string[];
  relations: Record<string, number>;
}

export interface War {
  id: string;
  name: string;
  parties: {
    attackers: string[];
    defenders: string[];
  };
  startYear: number;
  status: "active" | "frozen" | "ended";
  casualties: number;
}

export interface Alliance {
  id: string;
  name: string;
  members: string[];
  formed: number;
  type: "defense" | "economic" | "political";
  strength: number;
}

export interface GlobalAggregate {
  totalPopulation: number;
  avgTechnologyLevel: number;
  avgHealthOutcome: number;
  co2Emissions: number;
  tradeVolume: number;
}
