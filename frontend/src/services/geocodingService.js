// src/services/geocodingService.js

export const geocodingService = {
    async reverseGeocode(lng, lat, mapTilerKey) {
        const response = await fetch(
            `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${mapTilerKey}`
        );
        if (!response.ok) {
            throw new Error('Error de red al geocodificar');
        }
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const firstFeature = data.features[0];
            const fullAddress = firstFeature.place_name;

            let postcode = '';
            let country = '';

            if (firstFeature.context) {
                const postalContext = firstFeature.context.find(c => c.id && c.id.startsWith('postal_code'));
                if (postalContext) postcode = postalContext.text;

                const countryContext = firstFeature.context.find(c => c.id && c.id.startsWith('country'));
                if (countryContext) country = countryContext.text;
            }

            if (!postcode && firstFeature.properties?.postal_code) {
                postcode = firstFeature.properties.postal_code;
            }

            return {
                address: fullAddress,
                postcode: postcode || 'S/N',
                country: country || 'Spain'
            };
        }

        throw new Error('Dirección no encontrada');
    }
};