declare module "markty-toml" {
    type TomlValue = string | number | boolean | null | Date | Array<TomlValue> | { [key: string]: TomlValue }

    function toml(input: string): TomlValue

    export default toml
}
