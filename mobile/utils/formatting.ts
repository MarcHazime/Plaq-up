import * as Plate from './plate';

/** Progressive display formatting of a plate while typing. Delegates to Plate. */
export const formatPlate = (text: string): string => Plate.format(text);
