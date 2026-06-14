// jira.test.ts
// Auto-generated conformance test for jira → projects
// Do not edit manually

import { JiraAdapter } from '../adapters/projects/jira';
import type { ProjectsContract } from '../interfaces/projects';

describe('JiraAdapter implements ProjectsContract', () => {
  const adapter: ProjectsContract = new JiraAdapter({
    base_url: 'test',
    email: 'test',
    api_token: 'test'
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
