// Dati istituzionali dall'atto costitutivo, dallo Statuto e dal certificato di attribuzione del codice fiscale.
// Solo dati dell'associazione: niente codici fiscali, date di nascita, indirizzi o firme dei soci.

export const association = {
  name: "Insieme Oltre ODV",
  foundedOn: "17 ottobre 2026",
  foundedOnIso: "2026-10-17",
  taxCode: "91019080638",
  address: {
    street: "Via Rosato 4",
    postalCode: "80072",
    city: "Barano d’Ischia",
    province: "NA",
  },
  email: "info@insiemeoltreischia.it",
};

export const associationAddress = `${association.address.street}, ${association.address.postalCode} ${association.address.city} (${association.address.province})`;

export const board = [
  { name: "Paolo Nuzzo", role: "Presidente" },
  { name: "Luca Renna", role: "Vicepresidente" },
  { name: "Daniela Barone", role: "Segretario-Tesoriere" },
  { name: "Antonella Giordano", role: "Consigliere" },
  { name: "Annalisa Iacono", role: "Consigliere" },
];
