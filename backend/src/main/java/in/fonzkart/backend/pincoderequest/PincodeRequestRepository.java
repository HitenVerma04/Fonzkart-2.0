package in.fonzkart.backend.pincoderequest;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PincodeRequestRepository extends JpaRepository<PincodeRequest, String> {

    List<PincodeRequest> findByPartnerIdOrderByCreatedAtDesc(String partnerId);

    List<PincodeRequest> findByStatusOrderByCreatedAtAsc(String status);

    List<PincodeRequest> findTop100ByStatusNotOrderByCreatedAtDesc(String status);
}
