import SVGInjector from "svg-injector"

import { Participant, get_stored_participant_list } from "./data"

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

export class ParticipantListUI {
    #root: HTMLDivElement
    #participants_list: HTMLDivElement
    static singleton: ParticipantListUI

    constructor() {
        this.#participants_list = element_factory('div', { class: 'participants_list' })

        const add_participant_button = element_factory('button', { id: 'add_participant_button' }, [
            svg_inject_later(element_factory('img', { src: '/img/Add.svg' })),
            element_factory('div', {}, "Ajouter un participant"),
        ])

        add_participant_button.addEventListener('click', () => {
            this.add_participant()
        })

        this.#root = element_factory('div', {}, [this.#participants_list, add_participant_button])
        ParticipantListUI.singleton = this

        this.#init_with_stored_participants()
    }

    #init_with_stored_participants() {
        for (const stored_participant of get_stored_participant_list())
            this.#participants_list.insertAdjacentElement('beforeend', new ParticipantUI(stored_participant).get_elem())
    }

    get_elem(): HTMLDivElement {
        return this.#root
    }

    add_participant() {
        const new_participant = new ParticipantUI()
        this.#participants_list.insertAdjacentElement('beforeend', new_participant.get_elem())
        new_participant.focus()
    }
}

class ParticipantUI {
    #root: HTMLDivElement
    #input: HTMLInputElement
    #participant?: Participant

    constructor(participant?: Participant) {
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

        this.#input.addEventListener('input', () => { this.on_input(this.#input.value) })
        this.#input.addEventListener('keyup', (event) => { if (event.key === 'Enter' && this.#input.value.length > 0) ParticipantListUI.singleton.add_participant() })
        this.#input.addEventListener('focusout', (event) => { if (event.relatedTarget === delete_button || this.#input.value.length === 0) this.delete_participant() })
        document.addEventListener('delete_participant', (event: CustomEventInit<Participant>) => {
            if (event.detail === this.#participant) this.remove_elem()
        })
        // delete_button.addEventListener('click', () => { this.remove() }) // focusout...

        if (participant !== undefined) {
            this.#participant = participant
            this.#input.value = participant.name
        }
    }

    get_elem(): HTMLDivElement {
        return this.#root
    }

    focus() { this.#input.focus() }

    on_input(name_value: string) {
        if (this.#participant === undefined && name_value.length > 0)
            this.#participant = new Participant(name_value)
        else if (this.#participant !== undefined)
            this.#participant.name = name_value
    }

    delete_participant() {
        this.#participant?.delete()
        this.remove_elem()
    }
    remove_elem() {
        this.#root.remove()
    }
}
