
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

// function cookie_read(name: string): string | undefined {
//     return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop()
// }
// export function is_data_stored(): boolean {
//     console.log(cookie_read('noel_data'))
//     return cookie_read('noel_data') !== undefined
// }
// export function get_stored_participant_list(): Array<Participant> {
//     const stored_participant_list: Array<Participant> = []
//     const stored_string: string | undefined = cookie_read('noel_data')
//     if (stored_string !== undefined)
//         for (const participant_name of (JSON.parse(stored_string) as Array<string>))
//             stored_participant_list.push(new Participant(participant_name, true))

//     return stored_participant_list
// }
// function store_data() {
//     console.log('💾 Data stored')

//     if (participant_list.length > 0) {
//         // Expire in 6 months
//         const expiration_date = new Date(); expiration_date.setTime(expiration_date.getTime() + (365 / 2 * 24 * 60 * 60 * 1000))
//         document.cookie = `noel_data=${JSON.stringify(participant_list)};expires=${expiration_date.toUTCString()};path=/`
//     } else
//         document.cookie = `noel_data=;expires=${new Date().toUTCString()};path=/`
// }
