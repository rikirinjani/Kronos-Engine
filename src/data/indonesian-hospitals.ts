import type { HospitalSentinelConfig } from "../sectors/deers-rock-adapter.js";

export interface HospitalRegion {
  region: string;
  label: string;
  hospitals: HospitalSentinelConfig[];
}

export const HOSPITAL_REGIONS: HospitalRegion[] = [
  {
    region: "java",
    label: "Java",
    hospitals: [
      { id: "jkt-001", city: "Jakarta", beds: 500, patients: 200, ticksPerDay: 10 },
      { id: "jkt-002", city: "Jakarta", beds: 350, patients: 140, ticksPerDay: 10 },
      { id: "bdo-001", city: "Bandung", beds: 300, patients: 120, ticksPerDay: 10 },
      { id: "sby-001", city: "Surabaya", beds: 400, patients: 160, ticksPerDay: 10 },
      { id: "smg-001", city: "Semarang", beds: 250, patients: 100, ticksPerDay: 10 },
      { id: "jog-001", city: "Yogyakarta", beds: 200, patients: 80, ticksPerDay: 10 },
      { id: "mlg-001", city: "Malang", beds: 180, patients: 70, ticksPerDay: 10 },
      { id: "bgr-001", city: "Bogor", beds: 150, patients: 60, ticksPerDay: 10 },
      { id: "cbn-001", city: "Cirebon", beds: 120, patients: 45, ticksPerDay: 10 },
    ],
  },
  {
    region: "sumatra",
    label: "Sumatra",
    hospitals: [
      { id: "mes-001", city: "Medan", beds: 350, patients: 140, ticksPerDay: 10 },
      { id: "plg-001", city: "Palembang", beds: 250, patients: 100, ticksPerDay: 10 },
      { id: "pku-001", city: "Pekanbaru", beds: 200, patients: 80, ticksPerDay: 10 },
      { id: "pdg-001", city: "Padang", beds: 180, patients: 70, ticksPerDay: 10 },
      { id: "bks-001", city: "Bengkulu", beds: 120, patients: 45, ticksPerDay: 10 },
      { id: "bjm-001", city: "Banjarmasin", beds: 150, patients: 60, ticksPerDay: 10 },
    ],
  },
  {
    region: "kalimantan",
    label: "Kalimantan",
    hospitals: [
      { id: "bpn-001", city: "Balikpapan", beds: 200, patients: 80, ticksPerDay: 10 },
      { id: "ptr-001", city: "Pontianak", beds: 180, patients: 70, ticksPerDay: 10 },
      { id: "smr-001", city: "Samarinda", beds: 160, patients: 60, ticksPerDay: 10 },
    ],
  },
  {
    region: "sulawesi",
    label: "Sulawesi",
    hospitals: [
      { id: "mks-001", city: "Makassar", beds: 300, patients: 120, ticksPerDay: 10 },
      { id: "mdo-001", city: "Manado", beds: 200, patients: 80, ticksPerDay: 10 },
      { id: "plw-001", city: "Palu", beds: 130, patients: 50, ticksPerDay: 10 },
      { id: "kdi-001", city: "Kendari", beds: 120, patients: 45, ticksPerDay: 10 },
      { id: "gtl-001", city: "Gorontalo", beds: 100, patients: 35, ticksPerDay: 10 },
    ],
  },
  {
    region: "eastern",
    label: "Eastern Indonesia",
    hospitals: [
      { id: "dps-001", city: "Denpasar", beds: 250, patients: 100, ticksPerDay: 10 },
      { id: "mtr-001", city: "Mataram", beds: 150, patients: 60, ticksPerDay: 10 },
      { id: "kpg-001", city: "Kupang", beds: 130, patients: 50, ticksPerDay: 10 },
      { id: "jpr-001", city: "Jayapura", beds: 180, patients: 70, ticksPerDay: 10 },
      { id: "amb-001", city: "Ambon", beds: 150, patients: 55, ticksPerDay: 10 },
      { id: "trt-001", city: "Ternate", beds: 100, patients: 35, ticksPerDay: 10 },
    ],
  },
];

export function getAllSentinels(): HospitalSentinelConfig[] {
  const all: HospitalSentinelConfig[] = [];
  for (const region of HOSPITAL_REGIONS) {
    for (const h of region.hospitals) {
      all.push(h);
    }
  }
  return all;
}

export const TOTAL_SENTINELS = getAllSentinels().length;
