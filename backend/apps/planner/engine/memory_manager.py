from apps.planner.models import PlannerMemory

class MemoryManager:
    """
    Manages long-term preferences and inferred context for a workspace.
    """
    @staticmethod
    def get_memory(workspace):
        memory, _ = PlannerMemory.objects.get_or_create(workspace=workspace)
        return memory

    @staticmethod
    def add_preference(workspace, key, value):
        memory = MemoryManager.get_memory(workspace)
        memory.preferences[key] = value
        memory.save()

    @staticmethod
    def add_constraint(workspace, key, value):
        memory = MemoryManager.get_memory(workspace)
        memory.constraints[key] = value
        memory.save()

    @staticmethod
    def get_summary(workspace):
        memory = MemoryManager.get_memory(workspace)
        return {
            'preferences': memory.preferences,
            'constraints': memory.constraints,
            'inferred_data': memory.inferred_data
        }
