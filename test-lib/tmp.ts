
type BasicTypes = void | undefined | null | number | string | Buffer | boolean
export type ReturnTypes = BasicTypes | { [key: string]: ReturnTypes } | Array<ReturnTypes> | ((...args: ReturnTypes[]) => Promise<ReturnTypes>)
export type TransferableTypes = ReturnTypes | { [key: string]: TransferableTypes } | Array<TransferableTypes> | Promise<TransferableTypes> | ((...args: TransferableTypes[]) => Promise<TransferableTypes>)