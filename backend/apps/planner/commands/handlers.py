from apps.planner.engine.command_executor import CommandExecutor
from apps.planner.services.plan_service import PlanService
from apps.planner.engine.context_manager import ContextManager
from apps.planner.models import CanvasInstance
import logging

logger = logging.getLogger(__name__)

@CommandExecutor.register("OPEN_CANVAS")
def handle_open_canvas(workspace, canvas_type, search_params=None):
    logger.info(f"Opening canvas {canvas_type} for workspace {workspace.id}")
    instance = CanvasInstance.objects.create(
        workspace=workspace,
        canvas_type=canvas_type,
        search_params=search_params or {}
    )
    return {"status": "success", "canvas_id": str(instance.id)}

@CommandExecutor.register("SET_BUDGET")
def handle_set_budget(workspace, amount):
    ContextManager.update_budget(workspace, amount)
    return {"status": "success"}

@CommandExecutor.register("ADD_CITY")
def handle_add_city(workspace, city_id, start_date=None, end_date=None):
    trip_city = PlanService.add_city_to_trip(workspace, city_id, start_date, end_date)
    return {"status": "success", "trip_city_id": str(trip_city.id)}
