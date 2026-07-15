import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';

export enum ClassroomMaterialType {
  LINK = 'link',
  FILE = 'file',
}

export enum ClassroomMaterialStorageProvider {
  LOCAL = 'local',
  CLOUDINARY = 'cloudinary',
}

@Entity('classroom_materials')
export class ClassroomMaterial {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_classroom_materials',
  })
  id!: string;

  @Column({ name: 'classroom_id', type: 'uuid' })
  @Index('IDX_classroom_materials_classroom_id')
  classroomId!: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.materials, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'classroom_id',
    foreignKeyConstraintName: 'FK_classroom_materials_classroom',
  })
  classroom!: Classroom;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ClassroomMaterialType })
  type!: ClassroomMaterialType;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({
    name: 'storage_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  storageName!: string | null;

  @Column({
    name: 'storage_provider',
    type: 'varchar',
    length: 16,
    default: ClassroomMaterialStorageProvider.LOCAL,
  })
  storageProvider!: ClassroomMaterialStorageProvider;

  @Column({
    name: 'original_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalName!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 160, nullable: true })
  mimeType!: string | null;

  @Column({ type: 'integer', nullable: true })
  size!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
