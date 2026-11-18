import Tesseract from 'tesseract.js';
import * as Plate from '../domain/plate';

export const extractPlateFromImage = async (imageBuffer: Buffer): Promise<string | null> => {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'eng', // Using English as it handles alphanumeric well
            { logger: m => console.log(m) }
        );

        console.log('OCR Text:', text);

        return Plate.fromOcr(text);
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to process image');
    }
};
