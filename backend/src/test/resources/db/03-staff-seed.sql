-- Seed for the riders / cities / executive / RM-dashboard parity scenario (golden/staff-scenario.json).
-- All passwords are 'pw' (bcryptjs hash). Rider passwords are plain text, exactly as the original stores them.
INSERT INTO "City" ("id","name","isActive","pincodes","displayOrder","isFeatured","createdAt","updatedAt","managerId") VALUES
 ('c-chennai','Chennai',true,'{600001,600002,600003}',2,false,'2026-01-01 00:00:00','2026-01-01 00:00:00',NULL),
 ('c-madurai','Madurai',true,'{}',1,false,'2026-01-01 00:00:00','2026-01-01 00:00:00',NULL),
 ('c-salem','Salem',false,'{636001}',0,false,'2026-01-01 00:00:00','2026-01-01 00:00:00',NULL);

INSERT INTO "User" ("id","name","email","passwordHash","createdAt","updatedAt","role","phone","cityId","pincodes","managerId") VALUES
 ('u-super','Root','admin@fonzkart.in','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:01','2026-01-01 00:00:01','SUPER_ADMIN','+919000000001',NULL,'{}',NULL),
 ('u-admin','Ops Admin','ops@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:02','2026-01-01 00:00:02','ADMIN',NULL,NULL,'{}',NULL),
 ('u-zh1','Zara Head','zh1@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:03','2026-01-01 00:00:03','ZONAL_HEAD',NULL,'c-chennai','{}',NULL),
 ('u-zh2','Zubin Head','zh2@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:04','2026-01-01 00:00:04','ZONAL_HEAD',NULL,NULL,'{}',NULL),
 ('u-p1','Partner One','p1@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:05','2026-01-01 00:00:05','PARTNER','+918000000001','c-chennai','{600001,600002}','u-zh1'),
 ('u-p2','Partner Two','p2@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:06','2026-01-01 00:00:06','PARTNER','+918000000002','c-madurai','{625001}',NULL),
 ('u-p3','Partner Three','p3@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:07','2026-01-01 00:00:07','PARTNER',NULL,NULL,'{}','u-zh1'),
 ('u-rm','Rita Manager','rm@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:08','2026-01-01 00:00:08','RELATIONSHIP_MANAGER',NULL,NULL,'{}',NULL),
 ('u-fe','Field Exec','fe@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:09','2026-01-01 00:00:09','FIELD_EXECUTIVE','+917000000004',NULL,'{}',NULL),
 ('u-fe2','Fe Two','fe2@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:10','2026-01-01 00:00:10','FIELD_EXECUTIVE',NULL,NULL,'{}',NULL),
 ('u-user','Plain User','user@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:11','2026-01-01 00:00:11','USER','+917000000009',NULL,'{}',NULL),
 ('u-user3','User Three','user3@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:12','2026-01-01 00:00:12','USER','+917000000005',NULL,'{}',NULL),
 ('u-user4','User Four','user4@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:13','2026-01-01 00:00:13','USER',NULL,NULL,'{}',NULL),
 ('u-cust','Customer','cust@example.test','$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa','2026-01-01 00:00:14','2026-01-01 00:00:14','USER','+916000000001',NULL,'{}',NULL);

UPDATE "City" SET "managerId" = 'u-zh1' WHERE "id" = 'c-chennai';

-- Rita (u-rm) is the relationship manager of Partner One and Partner Two; Partner Three has none.
UPDATE "User" SET "relationshipManagerId" = 'u-rm' WHERE "id" IN ('u-p1', 'u-p2');

INSERT INTO "Rider" ("id","name","phone","email","status","password","createdAt","updatedAt","partnerId") VALUES
 ('r1','Ravi','+917000000001','ravi@example.test','available','riderpw','2026-01-02 00:00:01','2026-01-02 00:00:01','u-p1'),
 ('r2','Suresh','+917000000002',NULL,'busy',NULL,'2026-01-02 00:00:02','2026-01-02 00:00:02','u-p2'),
 ('r3','Arun','+917000000003',NULL,'available',NULL,'2026-01-02 00:00:03','2026-01-02 00:00:03',NULL),
 ('r4','Kumar','+917000000004',NULL,'available','','2026-01-02 00:00:04','2026-01-02 00:00:04','u-p1'),
 ('r5','Mani','+917000000005',NULL,'available',NULL,'2026-01-02 00:00:05','2026-01-02 00:00:05',NULL),
 ('u-fe2','Fe Two Rider','+917000000006',NULL,'available',NULL,'2026-01-02 00:00:06','2026-01-02 00:00:06','u-p3');

INSERT INTO "Order" ("id","userId","riderId","device","price","status","address","locationLat","locationLng","answers","createdAt","updatedAt","orderNumber","pincode","offeredPrice","riderAnswers","verificationImages") VALUES
 ('o1','u-cust',NULL,'iPhone 13 (128GB)',30000,'Pending Pickup','1 Anna Salai, Chennai',12.9716,77.5946,'{"hubStatus":"handed_over","hubHandoverAt":"2026-01-02T00:00:00.000Z","hubReceivedBy":"Hub A"}','2026-01-01 10:00:00','2026-01-01 10:00:00',101,'600001',NULL,NULL,'{}'),
 ('o2','u-cust','r1','Galaxy S21 (8GB + 128GB)',20000,'assigned','2 Mount Road, Chennai',NULL,NULL,'not json','2099-01-01 10:00:00','2099-01-01 10:00:00',102,'600002',NULL,NULL,'{}'),
 ('o3','u-cust','r2','Pixel 8 (128GB)',25000,'completed','3 Temple St, Madurai',9.9252,78.1198,NULL,'2026-01-03 10:00:00','2026-01-03 10:00:00',103,'625001',24000,'{"answers":{"physical_condition":"good"},"notes":"ok"}','{a.jpg,b.jpg}'),
 ('o4','u-cust',NULL,'Mi 11X (8GB + 128GB)',9000,'Completed','4 Nowhere',NULL,NULL,'{"failLog":[]}','2026-01-04 10:00:00','2026-01-04 10:00:00',104,'999999',NULL,NULL,'{}'),
 ('o5','u-cust',NULL,'OnePlus 12 (12GB + 256GB)',35000,'completed','5 Market St, Madurai',NULL,NULL,'{"hubStatus":""}','2026-01-05 10:00:00','2026-01-05 10:00:00',105,'625001',NULL,NULL,'{}'),
 ('o6','u-cust','r3','Watch Series 8',8000,'picked_up','6 Lake Rd',0,77.0,'"just a string"','2026-01-06 10:00:00','2026-01-06 10:00:00',106,NULL,NULL,NULL,'{}');
