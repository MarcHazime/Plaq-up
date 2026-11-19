"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PSEUDO_MESSAGES = exports.displayName = void 0;
exports.normalizePseudo = normalizePseudo;
const Plate = __importStar(require("../domain/plate"));
const RESERVED = /plaq|admin|support|moderat|modéra/i;
/** Cleans a pseudo. An empty one removes it (value null). */
function normalizePseudo(raw) {
    const value = (raw ?? '').trim().replace(/\s+/g, ' ');
    if (!value)
        return { ok: true, value: null };
    if (value.length < 2 || value.length > 20)
        return { ok: false, reason: 'length' };
    if (!/^[\p{L}\p{N} _.\-]+$/u.test(value))
        return { ok: false, reason: 'characters' };
    if (Plate.parse(value))
        return { ok: false, reason: 'looks_like_plate' };
    if (RESERVED.test(value))
        return { ok: false, reason: 'reserved' };
    return { ok: true, value };
}
/** What other Users see: the pseudo if there is one, otherwise the Plate. */
const displayName = (pseudo, plate) => pseudo || plate || 'Inconnu';
exports.displayName = displayName;
exports.PSEUDO_MESSAGES = {
    length: 'Le pseudo doit contenir entre 2 et 20 caractères',
    characters: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, points, tirets et underscores',
    looks_like_plate: "Le pseudo ne peut pas ressembler à une plaque d'immatriculation",
    reserved: 'Ce pseudo est réservé',
};
