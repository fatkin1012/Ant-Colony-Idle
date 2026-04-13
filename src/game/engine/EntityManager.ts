import type { GameEntity, GameWorld } from './types';

export class EntityManager {
  private readonly entities = new Map<string, GameEntity>();

  add(entity: GameEntity) {
    this.entities.set(entity.id, entity);
  }

  remove(entityId: string) {
    this.entities.delete(entityId);
  }

  clear() {
    this.entities.clear();
  }

  update(deltaTime: number, world: GameWorld) {
    for (const entity of this.entities.values()) {
      if (entity.alive) {
        entity.update(deltaTime, world);
      }
    }

    for (const [entityId, entity] of this.entities) {
      if (!entity.alive) {
        this.entities.delete(entityId);
      }
    }
  }

  draw(context: CanvasRenderingContext2D, world: GameWorld) {
    for (const entity of this.entities.values()) {
      if (entity.alive) {
        entity.draw(context, world);
      }
    }
  }

  get(entityId: string) {
    return this.entities.get(entityId);
  }

  values() {
    return this.entities.values();
  }
}