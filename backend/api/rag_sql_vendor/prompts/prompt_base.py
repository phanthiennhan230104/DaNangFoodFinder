from abc import ABC, abstractmethod


class PromptBase(ABC):
    @abstractmethod
    def build(self, **kwargs) -> str:
        pass
