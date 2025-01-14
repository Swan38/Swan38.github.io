import SVGInjector from "svg-injector"

import './style.css'

import { ParticipantListUI } from "./ui"
import { is_data_stored } from "./data"


SVGInjector(document.querySelectorAll(`img[class="tab_selection_image"]`))

const container_participants: HTMLElement = document.getElementById(`container_participants`)!
container_participants.insertAdjacentElement('beforeend', new ParticipantListUI().get_elem())

const tutorial: HTMLDivElement = document.getElementById('tutorial') as HTMLDivElement
const tab_layout: HTMLDivElement = document.getElementById('tab_layout') as HTMLDivElement

{ // Tutorial or main app
    if (is_data_stored()) // TODO if data stored
        tutorial.style.display = 'none';
    else
        tab_layout.style.display = 'none';

    (document.getElementById('start_button') as HTMLButtonElement).onclick = () => {
        tutorial.classList.add('disappear')
        setTimeout(() => {
            tutorial.style.display = 'none'
            tab_layout.style.display = ''
            tab_layout.classList.add('appear')
        }, 500)
    }
}

{ // Frop file area
    const drop_area: HTMLLabelElement = document.getElementById('file_input_label') as HTMLLabelElement
    const drop_input: HTMLInputElement = drop_area.querySelector('input[type="file"]')!

    drop_area.ondragenter = () => { drop_area.setAttribute('hover_drop', '') }
    drop_area.ondragleave = (event) => { console.log(event); drop_area.removeAttribute('hover_drop') }
    drop_area.ondragover = drop_area.ondragenter = (event) => { event.preventDefault() }

    drop_area.ondrop = (event) => {
        drop_input.files = event.dataTransfer?.files || null
        event.preventDefault()
    }
}
