package in.fonzkart.backend.order.repository;

import in.fonzkart.backend.order.entity.OrderRecord;
import java.util.Collection;
import java.util.List;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Read-only order queries (no save/delete methods are exposed; transactions are database-enforced read-only). */
@Transactional(readOnly = true)
public interface OrderReadRepository extends Repository<OrderRecord, String> {

    /** db.getAllOrders(): prisma.order.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }) */
    List<OrderRecord> findAllByOrderByCreatedAtDesc();

    /** include: { orders: true } on riders */
    List<OrderRecord> findByRiderIdIn(Collection<String> riderIds);
}
