import SVGInjector from "svg-injector"

// import { Participant, get_stored_participant_list } from "./data"

function element_factory<K extends keyof HTMLElementTagNameMap>(tag_name: K, attributes?: Object, content?: Array<HTMLElement> | HTMLElement | string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag_name)

    // Attribute·s
    if (attributes !== undefined)
        for (const [key, value] of Object.entries(attributes))
            element.setAttribute(key, value)

    // Content
    if (content instanceof HTMLElement)
        element.insertAdjacentElement('beforeend', content)
    else if (typeof content === "string")
        element.innerHTML = content
    else if (content !== undefined) // instance of Array<HTMLElement>
        for (const child of content)
            element.insertAdjacentElement('beforeend', child)

    return element
}

declare global {
    interface HTMLElement {
        object?: Object
    }
}

function svg_inject_later(svg_element: HTMLImageElement): HTMLImageElement {
    setTimeout(() => { SVGInjector(svg_element) }, 0)
    return svg_element
}

interface ParticipantListEventMap {
    "create": Event // CustomEvent<ParticipantList>
    "update": Event
    // "delete": Event
}

export type ParticipantListRawData = Array<ParticipantRawData>

export class ParticipantList {
    #root: HTMLDivElement
    #participants_list_container: HTMLDivElement
    #participant_list: Array<Participant>

    constructor() {
        this.#participant_list = []
        this.#participants_list_container = element_factory('div', { class: 'participants_list' })

        const add_participant_button = element_factory('button', { id: 'add_participant_button' }, [
            svg_inject_later(element_factory('img', { src: '/img/Add.svg' })),
            element_factory('div', {}, "Ajouter un participant"),
        ])

        add_participant_button.addEventListener('click', () => {
            this.add_participant()
        })

        this.#root = element_factory('div', {}, [
            this.#participants_list_container,
            add_participant_button
        ])
        this.#root.object = this

        // this.#init_with_stored_participants()
    }

    addEventListener<K extends keyof ParticipantListEventMap>(type: K, listener: (this: Participant, ev: ParticipantListEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type, listener, options)
    }

    get participant_list(): Array<Participant> { return this.#participant_list }

    get_elem(): HTMLDivElement {
        return this.#root
    }

    add_participant() {
        const new_participant = new Participant(this)

        // Events
        new_participant.addEventListener('create', () => {
            this.#participant_list.push(new_participant)
            this.#root.dispatchEvent(new CustomEvent('create', { detail: new_participant }))
            this.#root.dispatchEvent(new Event('update'))
            new_participant.addEventListener('update', () => {
                this.#root.dispatchEvent(new Event('update'))
            })
            new_participant.addEventListener('delete', () => {
                this.#participant_list.splice(this.#participant_list.indexOf(new_participant), 1)
                this.#root.dispatchEvent(new Event('update'))
            }, { once: true })
        }, { once: true })

        this.#participants_list_container.insertAdjacentElement('beforeend', new_participant.get_elem())
        new_participant.focus()
    }

    get_raw_data(): ParticipantListRawData {
        return this.#participant_list.map((participant: Participant) => {
            return participant.get_raw_data()
        })
    }
    set_from_raw_data(raw_data: ParticipantListRawData) {
        this.#participants_list_container.innerHTML = ''
        this.#participant_list = []
        for (const participant_raw_data of raw_data) {
            const new_participant = new Participant(this)
            new_participant.set_from_raw_data(participant_raw_data)
            this.#participant_list.push(new_participant)

            // Events
            new_participant.addEventListener('update', () => {
                this.#root.dispatchEvent(new Event('update'))
            })
            new_participant.addEventListener('delete', () => {
                this.#participant_list.splice(this.#participant_list.indexOf(new_participant), 1)
                this.#root.dispatchEvent(new Event('update'))
            }, { once: true })

            this.#participants_list_container.insertAdjacentElement('beforeend', new_participant.get_elem())
        }
    }
}

interface ParticipantEventMap {
    "create": Event // Fired only once
    "update": Event
    "delete": Event // Fired only once
}

type ParticipantRawData = string

class Participant {
    #parent_list: ParticipantList
    #root: HTMLDivElement
    #input: HTMLInputElement
    #first_input_listener?: () => void
    // #participant?: Participant

    constructor(parent_list: ParticipantList) {
        this.#parent_list = parent_list
        this.#input = element_factory('input', { type: 'text', placeholder: 'Pseudonyme', size: '1' })
        const delete_image = element_factory('img', { src: '/img/Delete.svg' })
        const delete_button = element_factory('button', { class: 'delete_participant_button', type: 'button' }, svg_inject_later(delete_image))
        this.#root = element_factory(
            'div',
            { class: 'participant_definition' },
            [
                this.#input,
                delete_button,
            ]
        )
        this.#root.object = this

        // Create or update on input
        this.#first_input_listener = () => {
            this.#first_input_listener = undefined
            this.#root.dispatchEvent(new Event('create'))
            this.#input.addEventListener('input', () => {
                this.#root.dispatchEvent(new Event('update'))
            })
        }
        this.#input.addEventListener('input', this.#first_input_listener, { once: true })
        // New participant on enter key up
        this.#input.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' && this.#input.value.length > 0) this.#parent_list.add_participant()
        })
        // Delete on focus out if value == '' or delete button
        this.#input.addEventListener('focusout', (event) => {
            if (event.relatedTarget === delete_button || this.#input.value.length === 0) {
                this.remove_elem()
            }
        })
        // delete_button.addEventListener('click', () => { this.remove() }) // focusout...
    }

    addEventListener<K extends keyof ParticipantEventMap>(type: K, listener: (this: Participant, ev: ParticipantEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type, listener, options)
    }

    get_elem(): HTMLDivElement {
        return this.#root
    }

    get name() { return this.#input.value }
    set name(value: string) { this.#input.value = value }

    focus() { this.#input.focus() }

    remove_elem() {
        this.#root.dispatchEvent(new Event('delete'))
        this.#root.remove()
    }

    get_raw_data() {
        return this.name
    }
    set_from_raw_data(raw_data: ParticipantRawData) {
        this.name = raw_data

        // Events
        if (this.#first_input_listener !== undefined) {
            this.#input.removeEventListener('input', this.#first_input_listener)
            this.#input.addEventListener('input', () => {
                this.#root.dispatchEvent(new Event('update'))
            })
        }
    }
}
