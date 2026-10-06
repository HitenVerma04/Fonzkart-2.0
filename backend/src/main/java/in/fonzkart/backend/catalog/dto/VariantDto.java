package in.fonzkart.backend.catalog.dto;

import in.fonzkart.backend.catalog.entity.Variant;

/** Same JSON shape as the Prisma Variant object returned to the frontend today. */
public record VariantDto(String id, String modelId, String name, Integer basePrice) {

    public static VariantDto from(Variant variant) {
        return new VariantDto(variant.getId(), variant.getModelId(), variant.getName(), variant.getBasePrice());
    }
}
