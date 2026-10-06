package in.fonzkart.backend.catalog.dto;

import in.fonzkart.backend.catalog.entity.DeviceModel;

/** Same JSON shape as the Prisma Model object returned to the frontend today. */
public record ModelDto(String id, String brandId, String name, String img, String category, Integer priority) {

    public static ModelDto from(DeviceModel model) {
        return new ModelDto(model.getId(), model.getBrandId(), model.getName(), model.getImg(),
                model.getCategory(), model.getPriority());
    }

    public ModelDto withImg(String newImg) {
        return new ModelDto(id, brandId, name, newImg, category, priority);
    }
}
