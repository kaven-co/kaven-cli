declare module '@inquirer/prompts' {
  export interface InputOptions {
    message: string;
    default?: string;
    validate?: (value: string) => boolean | string | Promise<boolean | string>;
  }

  export interface SelectChoice<T = string> {
    name: string;
    value: T;
    disabled?: boolean | string;
    description?: string;
  }

  export interface SelectOptions<T = string> {
    message: string;
    choices: Array<SelectChoice<T>>;
    default?: T;
    pageSize?: number;
  }

  export interface ConfirmOptions {
    message: string;
    default?: boolean;
  }

  export function input(options: InputOptions): Promise<string>;
  export function select<T = string>(options: SelectOptions<T>): Promise<T>;
  export function confirm(options: ConfirmOptions): Promise<boolean>;
}
