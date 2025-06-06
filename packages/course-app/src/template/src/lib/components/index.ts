import { components as CalComponents } from './cal';
import { components as PosthogComponents } from './posthog';
import { components as ClassicComponents } from './classic';
import { components as MinimalComponents } from './minimal';
import { components as ExamprepComponents } from './examprep';
import { components as WebflowComponents } from './webflow';
import { components as BootcampComponents } from './bootcamp';

function getComponents() {
  switch (import.meta.env.VITE_TEMPLATE) {
    case 'posthog':
      return PosthogComponents;
    case 'classic':
      return ClassicComponents;
    case 'minimal':
      return MinimalComponents;
    case 'examprep':
      return ExamprepComponents;
    case 'webflow':
      return WebflowComponents;
    case 'bootcamp':
      return BootcampComponents;
    default:
      return CalComponents;
  }
}

export const components = {
  ...getComponents()
};
