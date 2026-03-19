// src/settings/entities/setting.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Setting {
  @PrimaryColumn()
  key: string; // 'MONITORING_INTERVAL', 'RAM_THRESHOLD', 'RETENTION_DAYS', etc.

  @Column()
  value: string;
}