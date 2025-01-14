
export class Participant {
    #name: string

    constructor(name?: string, mute_event: boolean = false) {
        this.#name = name || ''

        participant_list.push(this)

        // Event
        // https://stackoverflow.com/questions/43001679/how-do-you-create-custom-event-in-typescript
        if (!mute_event)
            document.dispatchEvent(new CustomEvent('new_participant', { detail: this }))
    }

    delete() {
        participant_list.splice(participant_list.indexOf(this), 1)
        document.dispatchEvent(new CustomEvent('delete_participant', { detail: this }))
    }

    set name(value: string) {
        this.#name = value
        document.dispatchEvent(new CustomEvent('update_participant', { detail: this }))
    }
    get name() { return this.#name }

    toJSON() {
        return this.#name
    }
}

export const participant_list: Array<Participant> = []

function store_data() {
    console.log('💾 Data stored')

    if (participant_list.length > 0) {
        // Expire in 6 months
        const expiration_date = new Date(); expiration_date.setTime(expiration_date.getTime() + (365 / 2 * 24 * 60 * 60 * 1000))
        document.cookie = `noel_data=${JSON.stringify(participant_list)};expires=${expiration_date.toUTCString()};path=/`
    } else
        document.cookie = `noel_data=;expires=${new Date().toUTCString()};path=/`
}

var debounce_store_data_timeout: number | undefined = undefined
function debounce_store_data() {
    clearTimeout(debounce_store_data_timeout)
    debounce_store_data_timeout = setTimeout(() => {
        debounce_store_data_timeout = undefined
        store_data()
    }, 1000)
}

document.addEventListener('new_participant', debounce_store_data)
document.addEventListener('delete_participant', debounce_store_data)
document.addEventListener('update_participant', debounce_store_data)

function cookie_read(name: string): string | undefined {
    return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop()
}

export function is_data_stored(): boolean {
    console.log(cookie_read('noel_data'))
    return cookie_read('noel_data') !== undefined
}

export function get_stored_participant_list(): Array<Participant> {
    const stored_participant_list: Array<Participant> = []
    const stored_string: string | undefined = cookie_read('noel_data')
    if (stored_string !== undefined)
        for (const participant_name of (JSON.parse(stored_string) as Array<string>))
            stored_participant_list.push(new Participant(participant_name, true))

    return stored_participant_list
}
