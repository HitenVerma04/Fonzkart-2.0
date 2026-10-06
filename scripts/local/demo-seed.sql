-- Demo orders for the local run (scripts/local/start.sh), on top of the test seeds: one order at every stage of the
-- order flow, all for the demo customer (Customer, cust@example.test). Logins: scripts/local/README.md.
-- Partner One covers pincodes 600001/600002 (Chennai) and Partner Two 625001 (Madurai); both have Rita as RM.
-- Ravi (r1) and Kumar (r4 = the "Field Exec" login) are Partner One's executives; Suresh (r2) is Partner Two's.

UPDATE "Rider" SET "status" = 'available' WHERE "id" IN ('r1', 'r4');

INSERT INTO "Order" ("id","userId","riderId","device","price","status","address","answers","createdAt","updatedAt","pincode","offeredPrice","riderAnswers","verificationImages","partnerId") VALUES
 -- 1. New, routed to Partner One, waiting for an executive
 ('demo-1','u-cust',NULL,'iPhone 14 (128GB)',38000,'Pending Pickup','12 Anna Salai, Chennai',
  '{"phone":"6000000001","paymentMethod":"amazon_voucher","scheduledDate":"2026-10-07T00:00:00.000Z","scheduledSlot":"10:00 AM - 02:00 PM","physical_condition":"good","body_condition":"minor_scratches","functional_issues":[]}',
  now() - interval '20 minutes', now(), '600001', NULL, NULL, '{}', 'u-p1'),
 -- 2. Executive (Field Exec) assigned
 ('demo-2','u-cust','r4','Galaxy S23 (8GB + 256GB)',32000,'assigned','45 Mount Road, Chennai',
  '{"phone":"6000000001","paymentMethod":"cash","isExpress":true,"physical_condition":"good","body_condition":"good","functional_issues":[]}',
  now() - interval '2 hours', now(), '600002', NULL, NULL, '{}', 'u-p1'),
 -- 3. The executive offered a lower price: waiting for approval before pickup
 ('demo-3','u-cust','r4','Pixel 8 (128GB)',30000,'pending_verification','7 Beach Road, Chennai',
  '{"phone":"6000000001","paymentMethod":"flipkart_voucher","physical_condition":"good","body_condition":"good","functional_issues":[],"priceReview":{"quotedPrice":30000,"requestedPrice":26000,"requestedAt":"2026-10-06T08:00:00.000Z","decision":"pending"}}',
  now() - interval '1 day', now(), '600001', 26000, '{"notes":"Back glass cracked, battery health 81%","imei":"350000000000001"}', '{}', 'u-p1'),
 -- 4. Picked up, customer not paid yet
 ('demo-4','u-cust','r2','OnePlus 12 (12GB + 256GB)',35000,'picked_up','3 Temple Street, Madurai',
  '{"phone":"6000000001","paymentMethod":"upi","upiId":"customer@upi","hubStatus":"pending","physical_condition":"good","body_condition":"good","functional_issues":[]}',
  now() - interval '2 days', now(), '625001', 35000, '{"notes":"As described"}', '{}', 'u-p2'),
 -- 5. Delivered to the hub and paid, after an approved price revision
 ('demo-5','u-cust','r1','iPhone 13 (128GB)',27500,'completed','9 Lake View, Chennai',
  '{"phone":"6000000001","paymentMethod":"amazon_voucher","hubStatus":"pending","quotedPrice":29000,"priceReview":{"quotedPrice":29000,"requestedPrice":27000,"decision":"approved","approvedPrice":27500,"decidedBy":"RELATIONSHIP_MANAGER","decidedAt":"2026-10-04T10:00:00.000Z"},"payout":{"status":"paid","method":"amazon_voucher","amount":27500,"reference":"AMZ-GC-ORDER-1042","paidAt":"2026-10-04T11:00:00.000Z","paidBy":"Ravi","byRole":"FIELD_EXECUTIVE"},"physical_condition":"good","body_condition":"good","functional_issues":[]}',
  now() - interval '3 days', now(), '600001', 27500, '{"notes":"Minor dent"}', '{}', 'u-p1'),
 -- 6. Failed (customer cancelled)
 ('demo-6','u-cust',NULL,'Redmi Note 13 (8GB + 128GB)',9000,'failed','21 Park Street, Chennai',
  '{"phone":"6000000001","paymentMethod":"cash","failLog":[{"date":"2026-10-05T09:00:00.000Z","reason":"Customer sold the phone elsewhere","by":"RELATIONSHIP_MANAGER"}]}',
  now() - interval '4 days', now(), '600002', NULL, NULL, '{}', 'u-p1'),
 -- 7. Pincode no partner covers: not routed yet (every RM sees it)
 ('demo-7','u-cust',NULL,'iPad Air (64GB)',22000,'Pending Pickup','5 Hill Road, Coimbatore',
  '{"phone":"6000000001","paymentMethod":"bank_transfer"}',
  now() - interval '10 minutes', now(), '641001', NULL, NULL, '{}', NULL);
