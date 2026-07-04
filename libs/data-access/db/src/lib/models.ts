import { Column, DataType, Model, Table, HasMany, ForeignKey, BelongsTo } from 'sequelize-typescript';

@Table({ tableName: 'runs' })
export class Run extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare problem: string;
  
  @Column({ type: DataType.FLOAT, defaultValue: 0.7 })
  declare temperature: number;

  @HasMany(() => NodeExecution)
  declare nodeExecutions: NodeExecution[];
}

@Table({ tableName: 'node_executions' })
export class NodeExecution extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  declare id: string;

  @ForeignKey(() => Run)
  @Column({ type: DataType.UUID, allowNull: false })
  declare runId: string;

  @BelongsTo(() => Run)
  declare run: Run;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nodeName: string;

  @Column({ type: DataType.JSONB })
  declare input: any;

  @Column({ type: DataType.JSONB })
  declare output: any;

  @Column({ type: DataType.JSONB })
  declare raw: any;

  @Column({ type: DataType.JSONB })
  declare tokens: any;

  @Column({ type: DataType.INTEGER })
  declare latencyMs: number;
}
