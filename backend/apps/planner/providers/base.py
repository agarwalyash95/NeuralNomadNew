from abc import ABC, abstractmethod

class AIProvider(ABC):
    """
    Abstract base class for all AI models (Gemini, OpenAI, etc).
    """
    @abstractmethod
    def generate_response(self, prompt, context=None):
        pass

    @abstractmethod
    def parse_commands(self, response_text):
        pass
