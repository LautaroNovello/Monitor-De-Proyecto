import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable } from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  ec2Url: string;

  @Column('json')
  containerMap: Record<string, string>;

  @Column({ default: true })
  isActive: boolean;

  // Configuración de monitoreo por proyecto
  @Column({ default: 10 })
  scrapingInterval: number; // segundos entre cada scrape

  @Column({ default: 2048 })
  maxRamMb: number; // RAM total de la instancia EC2 en MB

  // Credenciales SSH para logs y acciones remotas
  @Column({ nullable: true })
  sshUser: string;

  @Column({ type: 'text', nullable: true })
  sshKey: string; // Contenido completo del archivo .pem

  @ManyToMany(() => Contact, (contact) => contact.subscribedProjects, { cascade: true })
  @JoinTable()
  contacts: Contact[];
}
