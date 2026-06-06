# Antero physical → DAEMON canonical mapping

**Pack:** `logistics-commercial` v0.3.0 · **Domain:** `logistics` · **OM:** v2.0.3 Bab 5/7/8

## Core operational

| entityType | Antero table | Key columns | Cardinality note |
|------------|--------------|-------------|------------------|
| TTK | `pos` | `id`, `no_ttk`, `status`, `total_weight` | 1:1 with Shipment |
| Shipment | (canonical) | derived per destination line | 1:1 TTK; N per PickupRequest |
| PickupRequest | `pickup_request` | `id`, `code`, `status`, `office_id` | Parent intake |
| PickupShipment | `pickup_request_pos` | `pickup_request_id`, `pos_id` | Links to Shipment entity id |
| Manifest | `manifest` | `id`, `code`, `status`, `trip_id` | |
| ShipmentLeg | `manifest_detail` | `manifest_id`, `pos_id`, `leg_type`, `chargeable_weight_kg` | No `allocated_vendor_cost` in YAML |
| Trip | `trip` | `id`, `code`, `status` | |
| Dispatch | `dispatch` | `id`, `code`, `status` | |
| DispatchShipment | `dispatch_detail` | `dispatch_id`, `pos_id` | TTK = pos grain |
| RoutingDecision | `routing_decision` | `id`, `pos_id` / shipment link | |
| RegionalOffice | `kantor` | `id`, `name`, `code` | RO attribution |
| Evidence | `evidence_records` | `entity_type`, `entity_id`, `evidence_context`, `pos_id` | Maps OM POD Record |
| Project | `project` | `id`, `name` | |

## Commercial

| entityType | Antero table | Key columns |
|------------|--------------|-------------|
| Account | `customer` | `id`, `name`, `customer_tier`, `account_owner_ro_id` |
| Contact | `contact` | `id`, `name`, `phone` |
| Pipeline | `customer_pipeline` | `id`, `stage`, `customer_id` |

## Multi-TTK pickup pattern

One `pickup_request` with N `pos` rows:

1. Create N `Shipment` entities (one per destination).
2. Create N `TTK` entities (`shipmentRef` unique each).
3. Register N `PickupShipment` junctions (PickupRequest ↔ Shipment).

Do **not** attach multiple TTKs to one Shipment (violates OM Bab 5).

## CRM stubs (pack only, no Antero table yet)

Lead, Opportunity, Conversation, Activity, AccountPlan, Signal, Order — minimal YAML; flagged in integrator docs.
