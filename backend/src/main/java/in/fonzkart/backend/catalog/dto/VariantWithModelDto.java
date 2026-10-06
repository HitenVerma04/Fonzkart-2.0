package in.fonzkart.backend.catalog.dto;

/**
 * Shape returned by actions/catalog.ts → findVariantByName(): a variant with its model included
 * (Prisma {@code include: { model: true }}).
 */
public record VariantWithModelDto(String id, String modelId, String name, Integer basePrice, ModelDto model) {
}
