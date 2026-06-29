class ConflictDetector:
    """
    Detects overlaps in time or impossible travel situations.
    """
    @staticmethod
    def detect_conflicts(trip_day):
        activities = list(trip_day.activities.order_by('start_time', 'order'))
        conflicts = []
        for i in range(len(activities) - 1):
            curr = activities[i]
            next_act = activities[i+1]
            if curr.end_time and next_act.start_time:
                if curr.end_time > next_act.start_time:
                    conflicts.append({
                        'type': 'time_overlap',
                        'activity_1': curr.id,
                        'activity_2': next_act.id,
                        'message': f"Time overlap between {curr.title} and {next_act.title}"
                    })
        return conflicts
