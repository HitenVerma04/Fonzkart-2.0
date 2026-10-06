package in.fonzkart.backend.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.VariantDto;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.catalog.repository.DeviceModelRepository;
import in.fonzkart.backend.catalog.repository.VariantRepository;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VariantCatalogServiceTest {

    private final VariantRepository variantRepository = mock(VariantRepository.class);
    private final DeviceModelRepository modelRepository = mock(DeviceModelRepository.class);
    private final VariantCatalogService service = new VariantCatalogService(
            variantRepository, modelRepository, new CatalogStaticData(new ObjectMapper()));

    @BeforeEach
    void emptyDatabase() {
        when(variantRepository.findFirstByNameAndModelNameInsensitive(anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(variantRepository.findByModelIdOrderByBasePriceAsc(anyString())).thenReturn(List.of());
    }

    @Test
    void parsesDeviceNameAndQueriesDatabaseWithTrimmedParts() {
        service.findVariantByName("  Galaxy S26 Ultra 5G  (  12GB + 256GB )");
        verify(variantRepository).findFirstByNameAndModelNameInsensitive("12GB + 256GB", "Galaxy S26 Ultra 5G");
    }

    @Test
    void deviceNameWithoutParenthesesReturnsNothingWithoutQuerying() {
        assertThat(service.findVariantByName("Galaxy S26 Ultra 5G")).isEmpty();
        verify(variantRepository, never()).findFirstByNameAndModelNameInsensitive(anyString(), anyString());
    }

    @Test
    void fallsBackToCatalog2026ByCanonicalNameAndAlphanumericVariant() {
        Optional<VariantWithModelDto> found = service.findVariantByName("Samsung Galaxy S26 Ultra (12gb+256gb)");
        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo("galaxy-s26-ultra-5g-12-256");
        assertThat(found.get().basePrice()).isEqualTo(78540);
        assertThat(found.get().model().id()).isEqualTo("galaxy-s26-ultra-5g");
    }

    @Test
    void getVariantsFallsBackToCatalogByIdOrName() {
        List<VariantDto> byId = service.getVariants("galaxy-s26-ultra-5g");
        assertThat(byId).extracting(VariantDto::id)
                .containsExactly("galaxy-s26-ultra-5g-12-256", "galaxy-s26-ultra-5g-16-512");
        assertThat(byId).allMatch(v -> v.modelId().equals("galaxy-s26-ultra-5g"));

        assertThat(service.getVariants("  GALAXY S26 ULTRA 5G ")).hasSize(2);
        assertThat(service.getVariants("unknown-model")).isEmpty();
    }
}
