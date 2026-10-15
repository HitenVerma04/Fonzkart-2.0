package in.fonzkart.backend.order.repository;

import in.fonzkart.backend.order.entity.CustomerOrder;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** "Order" queries equivalent to the Prisma calls in lib/store.ts, actions/*.ts and app/api/admin/orders. */
public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, String> {

    /** db.getOrders(userId): findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }) */
    List<CustomerOrder> findByUserIdOrderByCreatedAtDesc(String userId);

    /** db.getAllOrders(): findMany({ orderBy: { createdAt: 'desc' } }) */
    List<CustomerOrder> findAllByOrderByCreatedAtDesc();

    /** findMany({ where: { id: { in: ids } } }) */
    List<CustomerOrder> findByIdIn(Collection<String> ids);

    /** unassigned-count: findMany({ where: { riderId: null, status: { notIn: ['completed', 'failed'] } } }) */
    @Query("SELECT o FROM CustomerOrder o WHERE o.riderId IS NULL AND o.status NOT IN ('completed', 'failed')")
    List<CustomerOrder> findOpenWithoutExecutive();
}
