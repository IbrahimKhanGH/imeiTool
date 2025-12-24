export const SICKW_SERVICES = {
  iphoneCarrierFmiBlacklist: {
    id: "61",
    name: "iPhone Carrier & FMI & Blacklist",
    description:
      "Carrier, FMI, and blacklist info for iPhones (instant).",
    price: "0.07",
  },
  samsungKnoxGuardInfo: {
    id: "82",
    name: "Samsung KNOX Guard Info",
    description: "KNOX Guard info for Samsung devices.",
    price: "0.30",
  },
} as const;

export type SickWServiceKey = keyof typeof SICKW_SERVICES;

export const getServiceMetaById = (serviceId: string | undefined) => {
  if (!serviceId) return undefined;
  return Object.values(SICKW_SERVICES).find((service) => service.id === serviceId);
};




