package in.fonzkart.backend.catalog.dto;

import in.fonzkart.backend.catalog.entity.Brand;
import java.util.Arrays;
import java.util.List;

/** Same JSON shape as the Prisma Brand object returned to the frontend today. */
public record BrandDto(String id, String name, String logo, List<String> categories, Integer priority) {

    public static BrandDto from(Brand brand) {
        String[] categories = brand.getCategories();
        return new BrandDto(
                brand.getId(),
                brand.getName(),
                brand.getLogo(),
                categories == null ? List.of() : Arrays.asList(categories),
                brand.getPriority());
    }
}
