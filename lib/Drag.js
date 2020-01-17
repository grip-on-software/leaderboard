import * as d3 from 'd3';

class Drag {
    constructor(config, normalize) {
        this.config = config;
        this.normalize = normalize;
    }

    start(cards) {
        const drag = this;
        cards.call(d3.drag().container(document.body).on("start", function() {
            drag.startDrag(this);
        }));
    }

    startDrag(card) {
        d3.select(this.config.element).classed('drag-area', true);
        var dragCard = d3.select(card).classed('drag-card', true);
        var start = d3.mouse(document.body);
        var currentX = dragCard.datum().x;
        var currentY = dragCard.datum().y;
        var prevUnderElement = d3.selectAll([]);
        d3.event.on("drag", d => {
            // Retrieve viewport coordinates of the mouse event
            const viewX = start[0] - d.x + d3.event.x - (document.documentElement.scrollLeft || document.body.scrollLeft);
            const viewY = start[1] - d.y + d3.event.y - (document.documentElement.scrollTop || document.body.scrollTop);

            var underElement = this.findCards(viewX, viewY);
            var overDroppable = false;
            if (!underElement.empty()) {
                d3.selectAll('.droppable').classed('droppable', false);
                underElement.classed('droppable', true);

                if (this.getDropNormalize(dragCard.datum(), underElement.datum()) !== null) {
                    overDroppable = true;
                }
            }
            dragCard.classed('over-droppable', overDroppable);
            prevUnderElement = underElement;

            currentX += d3.event.dx;
            currentY += d3.event.dy;
            dragCard.classed('dragging', true)
                .style('left', `${currentX}px`)
                .style('top', `${currentY}px`);
        }).on("end", () => {
            this.endDrag(dragCard, prevUnderElement);
        });
    }

    endDrag(dragCard, prevUnderElement) {
        var transitionElement = dragCard;
        var mustRecreate = false;
        if (!prevUnderElement.empty()) {
            var dropCard = d3.select(prevUnderElement.node());

            const dragData = dragCard.datum();
            const dropData = dropCard.datum();
            const normalizeKey = this.getDropNormalize(dragData, dropData);

            if (normalizeKey !== null) {
                mustRecreate = true;
                this.normalize[dropData.feature] = normalizeKey === dropData.feature ? null : normalizeKey;
            }
            else {
                // Swap the dragged card with the first droppable card.
                // Only using CSS, DOM order is preserved.

                var dragNode = dragCard.node().parentNode;
                var dropNode = dropCard.node().parentNode;

                d3.selectAll([dropNode, dropCard.node()]).datum(d => {
                    const newData = _.clone(d);
                    newData.x = dragData.x + (dragNode.offsetLeft - dropNode.offsetLeft);
                    newData.y = dragData.y + (dragNode.offsetTop - dropNode.offsetTop);
                    return newData;
                });
                d3.selectAll([dragNode, dragCard.node()]).datum(d => {
                    const newData = _.clone(d);
                    newData.x = dropData.x + (dropNode.offsetLeft - dragNode.offsetLeft);
                    newData.y = dropData.y + (dropNode.offsetTop - dragNode.offsetTop);
                    return newData;
                });
                transitionElement = d3.selectAll([dragCard.node(), prevUnderElement.node()]);
            }
        }
        transitionElement.transition().duration(200).ease(d3.easeLinear)
            .style('left', d => `${d.x}px`)
            .style('top', d => `${d.y}px`)
            .on('end', d => {
                d3.select('#cards').classed('drag-area', false);
                if (mustRecreate) {
                    this.config.createCards('same');
                }
                else {
                    d3.selectAll('.card').classed('droppable', false);
                    dragCard.classed('drag-card dragging over-droppable', false);
                }
            });
    }

    getDropNormalize(dragData, dropData) {
        if (dragData.feature === dropData.feature) {
            // Never normalize cards with the same feature (different projects)
            return null;
        }
        if (this.normalize[dragData.feature] === dropData.feature) {
            // Never normalize the card under the dragged card with the dragged
            // card's feature if it is normalized with the drop card feature.
            return null;
        }
        if (this.normalize[dropData.feature] === null) {
            // Normalize the card under the dragged card.
            return dragData.feature;
        }
        if (this.normalize[dropData.feature] === dragData.feature) {
            // Toggle-remove the normalization of the dragged card.
            return dropData.feature;
        }
        // No normalization
        return null;
    }

    // Find all cards under a point. During drag and drop, it ignores the card
    // that is currently being dragged.
    findCards(viewX, viewY) {
        if (typeof document.elementsFromPoint === "function") {
            return d3.selectAll(document.elementsFromPoint(viewX, viewY))
                .filter('.card:not(.dragging)');
        }
        return d3.selectAll('.card:not(.dragging)').filter(function() {
            const rect = this.getBoundingClientRect();
            return rect.left <= viewX && viewX <= rect.left + rect.width &&
                rect.top <= viewY && viewY <= rect.top + rect.height;
        });
    }
}

export default Drag;
