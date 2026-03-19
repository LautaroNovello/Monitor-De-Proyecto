import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Project } from '../../projects/entitties/proyectos.entity';

@Entity()
export class Contact {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    phoneNumber: string; // Formato: +54911xxxxxxxx

    @Column({ default: true })
    isActive: boolean;

    @ManyToMany(() => Project, (project) => project.contacts)
    subscribedProjects: Project[];
}
