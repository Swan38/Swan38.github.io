
export class Participant {
    #name: string

    constructor(name?: string) {
        this.#name = name || ''

        participant_list.push(this)

        // Event
        // https://stackoverflow.com/questions/43001679/how-do-you-create-custom-event-in-typescript
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
}

export const participant_list: Array<Participant> = []

document.addEventListener('new_participant', (event: CustomEventInit<Participant>) => { console.log(`+${event.detail?.name}`, participant_list) })
document.addEventListener('delete_participant', (event: CustomEventInit<Participant>) => { console.log(`-${event.detail?.name}`, participant_list) })
document.addEventListener('update_participant', (event: CustomEventInit<Participant>) => { console.log(`~${event.detail?.name}`, participant_list) })
