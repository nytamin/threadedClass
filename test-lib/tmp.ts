export type TransferableTypes = void | undefined | null | number | string | Buffer | boolean | { [key: string]: TransferableTypes } | Array<TransferableTypes> | Promise<TransferableTypes>
export type ReturnTypes = void | undefined | null | number | string | Buffer | boolean | { [key: string]: TransferableTypes } | Array<TransferableTypes>