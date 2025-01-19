
export namespace cookie {
    export function write(key: string, value: string, days: number = 365 / 2) {
        document.cookie = `${key}=${value};expires=${expires(days)};path=/`
    }
    export function erase(key: string) {
        document.cookie = `${key}=;expires=${new Date().toUTCString()};path=/`
    }
    export function read(key: string): string | undefined {
        return document.cookie.match('(^|;)\\s*' + key + '\\s*=\\s*([^;]+)')?.pop()
    }
    export function exists(key: string): boolean {
        return read(key) !== undefined
    }

    function expires(days: number): string {
        const expiration_date = new Date()
        expiration_date.setTime(expiration_date.getTime() + (days * 24 * 60 * 60 * 1000))
        return expiration_date.toUTCString()
    }
}
