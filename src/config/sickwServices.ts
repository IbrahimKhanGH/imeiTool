export const SICKW_SERVICES = {
  brandModelInfo: {
    id: "203",
    name: "Brand & Model Info",
    description:
      "Cheapest brand/model identifier. Good for quick device classification.",
    price: "0.02",
  },
  appleBasicInfo: {
    id: "30",
    name: "Apple Basic Info",
    description:
      "Basic Apple info including iCloud lock, purchase country, warranty, etc.",
    price: "0.05",
  },
  samsungInfo: {
    id: "80",
    name: "Samsung Info",
    description:
      "Warranty and country/carrier information for Samsung devices.",
    price: "0.06",
  },
  gsmaBlacklist: {
    id: "6",
    name: "GSMA Blacklist Status",
    description: "Worldwide blacklist check for any IMEI.",
    price: "0.12",
  },
  iphoneCarrierFmi: {
    id: "78",
    name: "iPhone Carrier & FMI",
    description:
      "Carrier and FMI (Find My iPhone) status for iPhones (instant).",
    price: "0.08",
  },
  iphoneCarrierFmiBlacklist: {
    id: "61",
    name: "iPhone Carrier & FMI & Blacklist",
    description:
      "Carrier, FMI, and blacklist info for iPhones (instant).",
    price: "0.07",
  },
} as const;

export type SickWServiceKey = keyof typeof SICKW_SERVICES;

export const getServiceMetaById = (serviceId: string | undefined) => {
  if (!serviceId) return undefined;
  return Object.values(SICKW_SERVICES).find((service) => service.id === serviceId);
};




