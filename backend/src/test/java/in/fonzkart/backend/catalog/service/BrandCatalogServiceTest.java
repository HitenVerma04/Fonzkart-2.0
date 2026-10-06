package in.fonzkart.backend.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.BrandDto;
import in.fonzkart.backend.catalog.repository.BrandRepository;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

class BrandCatalogServiceTest {

    private final BrandRepository repository = mock(BrandRepository.class);
    private final BrandCatalogService service =
            new BrandCatalogService(repository, new CatalogStaticData(new ObjectMapper()));

    @Test
    void expandsCategoryAliasesAndIncludesUncategorisedOnlyForSmartphone() {
        when(repository.findByAnyCategory(any(), anyBoolean())).thenReturn(List.of());

        service.getBrands("watch");
        verify(repository).findByAnyCategory(List.of("watch", "watch", "smartwatch"), false);

        service.getBrands("smartphone");
        verify(repository).findByAnyCategory(List.of("smartphone", "smartphone", "mobile"), true);

        service.getBrands("mobile");
        verify(repository).findByAnyCategory(List.of("mobile", "smartphone", "mobile"), false);
    }

    @Test
    void emptyCategoryMeansAllBrands() {
        when(repository.findAllByOrderByPriorityAscNameAsc()).thenReturn(List.of());
        service.getBrands("");
        verify(repository).findAllByOrderByPriorityAscNameAsc();
    }

    @Test
    void databaseErrorFallsBackToCoreBrandsFilteredByCategory() {
        when(repository.findByAnyCategory(any(), anyBoolean()))
                .thenThrow(new DataAccessResourceFailureException("down"));

        // Core brands whose categories include 'tv': samsung, xiaomi (original filter uses the raw category).
        List<BrandDto> tv = service.getBrands("tv");
        assertThat(tv).extracting(BrandDto::id).containsExactly("samsung", "xiaomi");

        // For 'smartphone' every missing core brand is added regardless of its categories.
        List<BrandDto> phones = service.getBrands("smartphone");
        assertThat(phones).hasSize(12);
        assertThat(phones.get(0).id()).isEqualTo("apple");
    }
}
