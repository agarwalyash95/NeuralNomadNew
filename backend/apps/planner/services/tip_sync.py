from django.db import transaction
from apps.planner.models import PlannerWorkspace
from apps.planner.services.block_schema import find_block

def mark_pending_tip(trip, block_id):
    """Marks a block as expecting an AI tip asynchronously."""
    block, _ = find_block(trip, block_id)
    if block:
        block.setdefault('metadata', {})
        block['metadata']['ai_tip_status'] = 'pending'
        trip.save(update_fields=['days', 'updated_at'])

def apply_generated_tip(workspace_id, block_id, tip_text):
    """Safely applies a generated tip to the trip block."""
    from apps.planner.services.block_enrichment import enrich_transport_block
    with transaction.atomic():
        workspace = PlannerWorkspace.objects.select_for_update().get(id=workspace_id)
        if not hasattr(workspace, 'trip'): 
            return
        trip = workspace.trip
        block, _ = find_block(trip, block_id)
        if block:
            block['ai_tip'] = tip_text
            block.setdefault('metadata', {})
            block['metadata']['ai_tip_status'] = 'ready'
            enrich_transport_block(trip, block)
            trip.save(update_fields=['days', 'updated_at'])
