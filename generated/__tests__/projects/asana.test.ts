// asana.test.ts
// Auto-generated conformance test for asana → projects
// Do not edit manually

import { AsanaAdapter } from '../adapters/projects/asana';
import type { ProjectsContract } from '../interfaces/projects';

describe('AsanaAdapter implements ProjectsContract', () => {
  const adapter: ProjectsContract = new AsanaAdapter({
    access_token: 'test'
  });

  it('has createProject method', () => {
    expect(typeof adapter.createProject).toBe('function');
  });

  it('has getProject method', () => {
    expect(typeof adapter.getProject).toBe('function');
  });

  it('has listProjects method', () => {
    expect(typeof adapter.listProjects).toBe('function');
  });

  it('has updateProject method', () => {
    expect(typeof adapter.updateProject).toBe('function');
  });

  it('has archiveProject method', () => {
    expect(typeof adapter.archiveProject).toBe('function');
  });

  it('has unarchiveProject method', () => {
    expect(typeof adapter.unarchiveProject).toBe('function');
  });

  it('has addProjectMember method', () => {
    expect(typeof adapter.addProjectMember).toBe('function');
  });

  it('has removeProjectMember method', () => {
    expect(typeof adapter.removeProjectMember).toBe('function');
  });

  it('has changeProjectOwner method', () => {
    expect(typeof adapter.changeProjectOwner).toBe('function');
  });

});
