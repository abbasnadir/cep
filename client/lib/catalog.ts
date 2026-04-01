import type { AreaRef, Category } from "@/lib/types";

export const ISSUE_CATEGORIES: Category[] = [
  { id: "sanitation", slug: "sanitation", label: "Sanitation" },
  { id: "flooding", slug: "flooding", label: "Flooding" },
  { id: "public-safety", slug: "public-safety", label: "Public Safety" },
  { id: "water-access", slug: "water-access", label: "Water Access" },
  { id: "road-damage", slug: "road-damage", label: "Road Damage" },
  { id: "environment", slug: "environment", label: "Environment" },
];

export const FALLBACK_AREAS: AreaRef[] = [
  { id: "builtin-india", name: "India", areaType: "country", parentAreaId: null },
  { id: "builtin-delhi", name: "Delhi", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-dwarka", name: "Dwarka", areaType: "locality", parentAreaId: "builtin-delhi" },
  { id: "builtin-saket", name: "Saket", areaType: "locality", parentAreaId: "builtin-delhi" },
  { id: "builtin-mumbai", name: "Mumbai", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-andheri", name: "Andheri", areaType: "locality", parentAreaId: "builtin-mumbai" },
  { id: "builtin-bandra", name: "Bandra", areaType: "locality", parentAreaId: "builtin-mumbai" },
  { id: "builtin-bengaluru", name: "Bengaluru", areaType: "city", parentAreaId: "builtin-india" },
  {
    id: "builtin-indiranagar",
    name: "Indiranagar",
    areaType: "locality",
    parentAreaId: "builtin-bengaluru",
  },
  {
    id: "builtin-whitefield",
    name: "Whitefield",
    areaType: "locality",
    parentAreaId: "builtin-bengaluru",
  },
  { id: "builtin-kolkata", name: "Kolkata", areaType: "city", parentAreaId: "builtin-india" },
  {
    id: "builtin-salt-lake",
    name: "Salt Lake",
    areaType: "locality",
    parentAreaId: "builtin-kolkata",
  },
  {
    id: "builtin-park-street",
    name: "Park Street",
    areaType: "locality",
    parentAreaId: "builtin-kolkata",
  },
  { id: "builtin-chennai", name: "Chennai", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-adyar", name: "Adyar", areaType: "locality", parentAreaId: "builtin-chennai" },
  {
    id: "builtin-t-nagar",
    name: "T Nagar",
    areaType: "locality",
    parentAreaId: "builtin-chennai",
  },
];
