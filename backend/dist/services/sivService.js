"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVehicleDetails = void 0;
// SIV External API is disabled. Returning local placeholder.
const getVehicleDetails = async (plate) => {
    // Return placeholder data so the frontend doesn't break
    // and the controller can proceed to check the local database.
    return {
        immatriculation: plate,
        marque: "Non disponible",
        modele: "Recherche interne",
        version: "Base de données locale"
    };
};
exports.getVehicleDetails = getVehicleDetails;
